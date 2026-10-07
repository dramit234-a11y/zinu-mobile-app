import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { AdminAuthService } from './admin/admin-auth.service.js';
import { AdminAuthController, AdminController } from './admin/admin.controllers.js';
import { AdminGuard } from './admin/admin.guard.js';
import { AdminDriversController } from './admin/drivers.controller.js';
import { GeoService } from './admin/geo.service.js';
import { AppConfigController } from './app-config/app-config.controller.js';
import { AuthController } from './auth/auth.controller.js';
import { UserAuthGuard } from './auth/auth.guard.js';
import { OTP_SENDER, createOtpSender } from './auth/otp-sender.js';
import { OtpService } from './auth/otp.service.js';
import { TokensService } from './auth/tokens.service.js';
import { AuditService } from './common/audit.service.js';
import { GlobalExceptionFilter } from './common/errors.js';
import { ConfigModule } from './config/config.module.js';
import { ENV, type Env } from './config/env.js';
import { DbModule } from './db/db.module.js';
import { CitiesController, DriverController } from './drivers/driver.controller.js';
import { DocumentExpiryService } from './drivers/expiry.service.js';
import { DriverRegistrationService } from './drivers/registration.service.js';
import { VerificationService } from './drivers/verification.service.js';
import { HealthController } from './health/health.controller.js';
import { JobsModule } from './jobs/jobs.module.js';
import { NotificationsController } from './notifications/notifications.controller.js';
import { NotificationsService } from './notifications/notifications.service.js';
import { PUSH_PROVIDER, createPushProvider } from './notifications/push.provider.js';
import { S3StorageService, StorageService } from './storage/storage.service.js';
import { UploadsController } from './uploads/uploads.controller.js';
import { UploadsService } from './uploads/uploads.service.js';
import { RedisModule } from './redis/redis.module.js';
import { MeController } from './users/me.controller.js';
import { UsersService } from './users/users.service.js';

@Module({
  imports: [ConfigModule, DbModule, RedisModule, JobsModule],
  controllers: [
    HealthController,
    AppConfigController,
    AuthController,
    MeController,
    NotificationsController,
    CitiesController,
    DriverController,
    UploadsController,
    AdminAuthController,
    AdminController,
    AdminDriversController,
  ],
  providers: [
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    { provide: OTP_SENDER, inject: [ENV], useFactory: (env: Env) => createOtpSender(env) },
    AuditService,
    OtpService,
    TokensService,
    UserAuthGuard,
    UsersService,
    AdminAuthService,
    AdminGuard,
    GeoService,
    { provide: StorageService, useClass: S3StorageService },
    { provide: PUSH_PROVIDER, inject: [ENV], useFactory: (env: Env) => createPushProvider(env) },
    UploadsService,
    NotificationsService,
    DriverRegistrationService,
    VerificationService,
    DocumentExpiryService,
  ],
})
export class AppModule {}
