import { Body, Controller, Get, HttpCode, Inject, Param, ParseUUIDPipe, Patch, Post, Put, Query, Req, Res, UseGuards } from '@nestjs/common';
import {
  Permission,
  adminLoginSchema,
  createCitySchema,
  createZoneSchema,
  paginationSchema,
  updateCitySchema,
  updateZoneSchema,
} from '@zinu/shared';
import { and, count, desc, eq, gte, ilike, lt, or, sql } from 'drizzle-orm';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { TokensService } from '../auth/tokens.service.js';
import { ENV, type Env } from '../config/env.js';
import { AuditService } from '../common/audit.service.js';
import { notFound } from '../common/errors.js';
import { clientIp } from '../common/request.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { DB, type Db } from '../db/db.module.js';
import { appVersions, auditLogs, cities, driverProfiles, staffRoles, staffUsers, userRoles, users, zones } from '../db/schema.js';
import { UsersService } from '../users/users.service.js';
import { AdminAuthService, type StaffPrincipal } from './admin-auth.service.js';
import { ADMIN_COOKIE, AdminGuard, CurrentStaff, RequirePermissions } from './admin.guard.js';
import { GeoService } from './geo.service.js';

type Pagination = z.output<typeof paginationSchema>;

@Controller('v1/admin/auth')
export class AdminAuthController {
  constructor(
    private readonly auth: AdminAuthService,
    private readonly audit: AuditService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  @Post('login')
  @HttpCode(200)
  async login(@Body(new ZodPipe(adminLoginSchema)) body: z.output<typeof adminLoginSchema>, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { token, staff } = await this.auth.login(body.email, body.password, body.totp);
    res.cookie(ADMIN_COOKIE, token, {
      httpOnly: true,
      secure: this.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: this.env.ADMIN_SESSION_TTL_SEC * 1000,
      path: '/',
    });
    await this.audit.record({ actorType: 'STAFF', actorId: staff.id, action: 'staff.login', ip: clientIp(req) });
    return { staff };
  }

  @Post('logout')
  @HttpCode(204)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(ADMIN_COOKIE, { path: '/' });
  }

  @Get('me')
  @UseGuards(AdminGuard)
  me(@CurrentStaff() staff: StaffPrincipal) {
    return { staff };
  }
}

@Controller('v1/admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly geo: GeoService,
    private readonly audit: AuditService,
    private readonly users: UsersService,
    private readonly tokens: TokensService,
  ) {}

  // ---------- Dashboard ----------

  @Get('dashboard')
  @RequirePermissions(Permission.DASHBOARD_VIEW)
  async dashboard() {
    const since = new Date(Date.now() - 86_400_000);
    const [[u], [today], roleCounts, driverStatus, [c], [zn]] = await Promise.all([
      this.db.select({ n: count() }).from(users).where(eq(users.status, 'ACTIVE')),
      this.db.select({ n: count() }).from(users).where(and(eq(users.status, 'ACTIVE'), gte(users.createdAt, since))),
      this.db.select({ role: userRoles.role, n: count() }).from(userRoles).innerJoin(users, eq(users.id, userRoles.userId)).where(eq(users.status, 'ACTIVE')).groupBy(userRoles.role),
      this.db.select({ status: driverProfiles.verificationStatus, n: count() }).from(driverProfiles).groupBy(driverProfiles.verificationStatus),
      this.db.select({ n: count() }).from(cities).where(eq(cities.status, 'ACTIVE')),
      this.db.select({ n: count() }).from(zones).where(eq(zones.active, true)),
    ]);
    return {
      activeUsers: u?.n ?? 0,
      newUsersLast24h: today?.n ?? 0,
      passengers: roleCounts.find((r) => r.role === 'PASSENGER')?.n ?? 0,
      drivers: roleCounts.find((r) => r.role === 'DRIVER')?.n ?? 0,
      driversByVerificationStatus: Object.fromEntries(driverStatus.map((d) => [d.status, d.n])),
      activeCities: c?.n ?? 0,
      activeZones: zn?.n ?? 0,
    };
  }

  // ---------- Cities & zones ----------

  @Get('cities')
  @RequirePermissions(Permission.CITIES_VIEW)
  listCities() {
    return this.geo.listCities();
  }

  @Get('cities/:id')
  @RequirePermissions(Permission.CITIES_VIEW)
  getCity(@Param('id', ParseUUIDPipe) id: string) {
    return this.geo.getCity(id);
  }

  @Post('cities')
  @RequirePermissions(Permission.CITIES_MANAGE)
  async createCity(@Body(new ZodPipe(createCitySchema)) body: z.output<typeof createCitySchema>, @CurrentStaff() staff: StaffPrincipal, @Req() req: Request) {
    const city = await this.geo.createCity(body);
    await this.audit.record({ actorType: 'STAFF', actorId: staff.id, action: 'city.created', entityType: 'city', entityId: city.id, after: city, ip: clientIp(req) });
    return city;
  }

  @Patch('cities/:id')
  @RequirePermissions(Permission.CITIES_MANAGE)
  async updateCity(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(updateCitySchema)) body: z.output<typeof updateCitySchema>, @CurrentStaff() staff: StaffPrincipal, @Req() req: Request) {
    const { before, after } = await this.geo.updateCity(id, body);
    await this.audit.record({ actorType: 'STAFF', actorId: staff.id, action: 'city.updated', entityType: 'city', entityId: id, before, after, ip: clientIp(req) });
    return after;
  }

  @Get('cities/:id/zones')
  @RequirePermissions(Permission.CITIES_VIEW)
  listZones(@Param('id', ParseUUIDPipe) id: string) {
    return this.geo.listZones(id);
  }

  @Post('cities/:id/zones')
  @RequirePermissions(Permission.ZONES_MANAGE)
  async createZone(@Param('id', ParseUUIDPipe) cityId: string, @Body(new ZodPipe(createZoneSchema)) body: z.output<typeof createZoneSchema>, @CurrentStaff() staff: StaffPrincipal, @Req() req: Request) {
    const zone = await this.geo.createZone(cityId, body as Parameters<GeoService['createZone']>[1]);
    await this.audit.record({ actorType: 'STAFF', actorId: staff.id, action: 'zone.created', entityType: 'zone', entityId: zone.id, after: { ...zone, boundary: undefined }, ip: clientIp(req) });
    return zone;
  }

  @Patch('zones/:id')
  @RequirePermissions(Permission.ZONES_MANAGE)
  async updateZone(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(updateZoneSchema)) body: z.output<typeof updateZoneSchema>, @CurrentStaff() staff: StaffPrincipal, @Req() req: Request) {
    const { before, after } = await this.geo.updateZone(id, body as Parameters<GeoService['updateZone']>[1]);
    await this.audit.record({ actorType: 'STAFF', actorId: staff.id, action: 'zone.updated', entityType: 'zone', entityId: id, before, after, ip: clientIp(req) });
    return after;
  }

  @Get('cities/:id/zones-at')
  @RequirePermissions(Permission.CITIES_VIEW)
  zonesAt(@Param('id', ParseUUIDPipe) id: string, @Query(new ZodPipe(z.object({ lat: z.coerce.number(), lng: z.coerce.number() }))) q: { lat: number; lng: number }) {
    return this.geo.zonesAt(id, q.lat, q.lng);
  }

  // ---------- Users ----------

  @Get('users')
  @RequirePermissions(Permission.USERS_VIEW)
  async listUsers(@Query(new ZodPipe(paginationSchema)) p: Pagination) {
    const conditions = [sql`${users.status} <> 'DELETED'`];
    if (p.cursor) conditions.push(lt(users.id, p.cursor));
    if (p.q) conditions.push(or(ilike(users.fullName, `%${p.q}%`), ilike(users.phone, `%${p.q}%`))!);
    const rows = await this.db
      .select({
        id: users.id,
        phone: users.phone,
        fullName: users.fullName,
        status: users.status,
        language: users.language,
        createdAt: users.createdAt,
        roles: sql<string[]>`coalesce((select array_agg(${userRoles.role} || ':' || ${userRoles.status}) from ${userRoles} where ${userRoles.userId} = ${users.id}), '{}')`,
      })
      .from(users)
      .where(and(...conditions))
      .orderBy(desc(users.id))
      .limit(p.limit + 1);
    const hasMore = rows.length > p.limit;
    const items = rows.slice(0, p.limit);
    return { items, nextCursor: hasMore ? items[items.length - 1]!.id : null };
  }

  @Get('users/:id')
  @RequirePermissions(Permission.USERS_VIEW)
  async getUser(@Param('id', ParseUUIDPipe) id: string) {
    const user = await this.db.query.users.findFirst({ where: eq(users.id, id) });
    if (!user || user.status === 'DELETED') throw notFound('User');
    const [roles, driver] = await Promise.all([
      this.db.select().from(userRoles).where(eq(userRoles.userId, id)),
      this.db.query.driverProfiles.findFirst({ where: eq(driverProfiles.userId, id) }),
    ]);
    return { ...user, roles, driver: driver ?? null };
  }

  @Post('users/:id/block')
  @HttpCode(200)
  @RequirePermissions(Permission.USERS_MANAGE)
  async block(@Param('id', ParseUUIDPipe) id: string, @CurrentStaff() staff: StaffPrincipal, @Req() req: Request) {
    return this.setUserStatus(id, 'BLOCKED', staff, req);
  }

  @Post('users/:id/unblock')
  @HttpCode(200)
  @RequirePermissions(Permission.USERS_MANAGE)
  async unblock(@Param('id', ParseUUIDPipe) id: string, @CurrentStaff() staff: StaffPrincipal, @Req() req: Request) {
    return this.setUserStatus(id, 'ACTIVE', staff, req);
  }

  private async setUserStatus(id: string, status: 'ACTIVE' | 'BLOCKED', staff: StaffPrincipal, req: Request) {
    const user = await this.db.query.users.findFirst({ where: eq(users.id, id) });
    if (!user || user.status === 'DELETED') throw notFound('User');
    await this.db.update(users).set({ status, updatedAt: new Date() }).where(eq(users.id, id));
    if (status === 'BLOCKED') await this.tokens.revokeAllForUser(id);
    await this.audit.record({ actorType: 'STAFF', actorId: staff.id, action: status === 'BLOCKED' ? 'user.blocked' : 'user.unblocked', entityType: 'user', entityId: id, before: { status: user.status }, after: { status }, ip: clientIp(req) });
    return { id, status };
  }

  // ---------- Staff & audit ----------

  @Get('staff')
  @RequirePermissions(Permission.STAFF_MANAGE)
  listStaff() {
    return this.db
      .select({ id: staffUsers.id, email: staffUsers.email, fullName: staffUsers.fullName, status: staffUsers.status, role: staffRoles.name, lastLoginAt: staffUsers.lastLoginAt })
      .from(staffUsers)
      .innerJoin(staffRoles, eq(staffRoles.id, staffUsers.roleId))
      .orderBy(staffUsers.fullName);
  }

  @Get('staff-roles')
  @RequirePermissions(Permission.STAFF_MANAGE)
  listRoles() {
    return this.db.select().from(staffRoles).orderBy(staffRoles.name);
  }

  @Get('audit-logs')
  @RequirePermissions(Permission.AUDIT_VIEW)
  async auditLogs(@Query(new ZodPipe(paginationSchema)) p: Pagination) {
    const rows = await this.db
      .select()
      .from(auditLogs)
      .where(p.cursor ? lt(auditLogs.id, Number(p.cursor)) : undefined)
      .orderBy(desc(auditLogs.id))
      .limit(p.limit + 1);
    const hasMore = rows.length > p.limit;
    const items = rows.slice(0, p.limit);
    return { items, nextCursor: hasMore ? String(items[items.length - 1]!.id) : null };
  }

  // ---------- App versions (splash-screen update gate) ----------

  @Get('app-versions')
  @RequirePermissions(Permission.SETTINGS_MANAGE)
  listVersions() {
    return this.db.select().from(appVersions);
  }

  @Put('app-versions/:platform')
  @RequirePermissions(Permission.SETTINGS_MANAGE)
  async setVersion(
    @Param('platform', new ZodPipe(z.enum(['android', 'ios']))) platform: string,
    @Body(new ZodPipe(z.object({ minSupported: z.string().regex(/^\d+\.\d+\.\d+$/), latest: z.string().regex(/^\d+\.\d+\.\d+$/) }))) body: { minSupported: string; latest: string },
    @CurrentStaff() staff: StaffPrincipal,
    @Req() req: Request,
  ) {
    await this.db
      .insert(appVersions)
      .values({ platform, ...body })
      .onConflictDoUpdate({ target: appVersions.platform, set: { ...body, updatedAt: new Date() } });
    await this.audit.record({ actorType: 'STAFF', actorId: staff.id, action: 'app_version.updated', entityType: 'app_version', entityId: platform, after: body, ip: clientIp(req) });
    return { platform, ...body };
  }
}
