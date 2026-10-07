import { Body, Controller, Get, HttpCode, Param, Post, Put, UseGuards } from '@nestjs/common';
import { DocType, driverPersonalSchema, driverVehicleSchema, payoutSchema, submitDocumentSchema } from '@zinu/shared';
import { z } from 'zod';
import { CurrentAuth, UserAuthGuard } from '../auth/auth.guard.js';
import type { AccessClaims } from '../auth/tokens.service.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { DriverRegistrationService } from './registration.service.js';

/** Public list of cities ZINU operates in (used by driver registration). */
@Controller('v1/cities')
export class CitiesController {
  constructor(private readonly registration: DriverRegistrationService) {}

  @Get()
  list() {
    return this.registration.listCities();
  }
}

@Controller('v1/driver')
@UseGuards(UserAuthGuard)
export class DriverController {
  constructor(private readonly registration: DriverRegistrationService) {}

  @Get('registration')
  get(@CurrentAuth() auth: AccessClaims) {
    return this.registration.getRegistration(auth.userId);
  }

  @Put('registration/personal')
  personal(@CurrentAuth() auth: AccessClaims, @Body(new ZodPipe(driverPersonalSchema)) body: z.output<typeof driverPersonalSchema>) {
    return this.registration.savePersonal(auth.userId, body);
  }

  @Put('registration/vehicle')
  vehicle(@CurrentAuth() auth: AccessClaims, @Body(new ZodPipe(driverVehicleSchema)) body: z.output<typeof driverVehicleSchema>) {
    return this.registration.saveVehicle(auth.userId, body);
  }

  @Put('documents/:type')
  document(
    @CurrentAuth() auth: AccessClaims,
    @Param('type', new ZodPipe(z.enum(Object.values(DocType) as [string, ...string[]]))) type: string,
    @Body(new ZodPipe(submitDocumentSchema)) body: z.output<typeof submitDocumentSchema>,
  ) {
    return this.registration.submitDocument(auth.userId, type, body);
  }

  @Put('payout')
  payout(@CurrentAuth() auth: AccessClaims, @Body(new ZodPipe(payoutSchema)) body: z.output<typeof payoutSchema>) {
    return this.registration.savePayout(auth.userId, body);
  }

  @Post('registration/submit')
  @HttpCode(200)
  submit(@CurrentAuth() auth: AccessClaims) {
    return this.registration.submit(auth.userId);
  }
}
