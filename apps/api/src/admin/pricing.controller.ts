import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Permission, RIDE_CATEGORIES, cityCategorySchema, pricingRuleSchema } from '@zinu/shared';
import type { Request } from 'express';
import { z } from 'zod';
import { AuditService } from '../common/audit.service.js';
import { clientIp } from '../common/request.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { PricingService } from '../rides/pricing.service.js';
import type { StaffPrincipal } from './admin-auth.service.js';
import { AdminGuard, CurrentStaff, RequirePermissions } from './admin.guard.js';

const codePipe = new ZodPipe(z.enum(RIDE_CATEGORIES as [string, ...string[]]));

/** Admin: Ride Categories and Pricing modules (spec §55, §57). */
@Controller('v1/admin')
@UseGuards(AdminGuard)
export class AdminPricingController {
  constructor(
    private readonly pricing: PricingService,
    private readonly audit: AuditService,
  ) {}

  @Get('ride-categories')
  @RequirePermissions(Permission.CITIES_VIEW)
  catalogue() {
    return this.pricing.catalogue();
  }

  @Get('cities/:id/ride-categories')
  @RequirePermissions(Permission.CITIES_VIEW)
  cityCategories(@Param('id', ParseUUIDPipe) id: string) {
    return this.pricing.cityCategories(id);
  }

  @Patch('cities/:id/ride-categories/:code')
  @RequirePermissions(Permission.PRICING_MANAGE)
  async setCategory(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('code', codePipe) code: string,
    @Body(new ZodPipe(cityCategorySchema)) body: z.output<typeof cityCategorySchema>,
    @CurrentStaff() staff: StaffPrincipal,
    @Req() req: Request,
  ) {
    const after = await this.pricing.setCityCategory(id, code, body);
    await this.audit.record({ actorType: 'STAFF', actorId: staff.id, action: 'ride_category.updated', entityType: 'city', entityId: id, after: { code, ...body }, ip: clientIp(req) });
    return after;
  }

  @Get('cities/:id/pricing/:code')
  @RequirePermissions(Permission.CITIES_VIEW)
  history(@Param('id', ParseUUIDPipe) id: string, @Param('code', codePipe) code: string) {
    return this.pricing.history(id, code);
  }

  /** Publishes a new fare version. Existing quotes keep the version they were priced with. */
  @Post('cities/:id/pricing/:code')
  @RequirePermissions(Permission.PRICING_MANAGE)
  async addVersion(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('code', codePipe) code: string,
    @Body(new ZodPipe(pricingRuleSchema)) body: z.output<typeof pricingRuleSchema>,
    @CurrentStaff() staff: StaffPrincipal,
    @Req() req: Request,
  ) {
    const rule = await this.pricing.addVersion(id, code, body, staff.id);
    await this.audit.record({ actorType: 'STAFF', actorId: staff.id, action: 'pricing.published', entityType: 'city', entityId: id, after: rule, ip: clientIp(req) });
    return rule;
  }
}
