import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { CustomerModule } from './customers/customers.module';
import { DeliveriesModule } from './deliveries/deliveries.module';
import { DeliveryAgentModule } from './deliveryagents/deliveryagents.module';
import { PlansModule } from './plans/plans.module';
import { PrismaModule } from './prisma/prisma.module';
import { UserModule } from './user/user.module';
import { MailerModule } from '@nestjs-modules/mailer';
import { PugAdapter } from '@nestjs-modules/mailer/dist/adapters/pug.adapter';
import { join } from 'path';
import { VariationModule } from './variations/variations.module';
import { ContactFormModule } from './contact-form/contact-form.module';
import { MessModule } from './mess/mess.module';
import { MessAdminModule } from './mess-admin/mess-admin.module';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ConfigModule } from '@nestjs/config';
import { AddressModule } from './user-address/user-address.module';


@Module({
  imports: [AuthModule, CustomerModule, DeliveriesModule, DeliveryAgentModule,
    PlansModule, PrismaModule, UserModule, VariationModule, ContactFormModule,
    MessModule, MessAdminModule, AddressModule,
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'uploads'),
      serveRoot: "/uploads",
      serveStaticOptions: {
        index: false,
      }
    }),

    ConfigModule.forRoot({
      isGlobal: true,  // ✅ ensures available everywhere
    }),

    MailerModule.forRoot({
      transport: {
        host: 'smtp.gmail.com',       // your SMTP host
        port: 587,
        secure: false,
        auth: {
          user: process.env.MAIL_USER,
          pass: process.env.MAIL_PASS,
        },
      },
      defaults: {
        from: '"No Reply" <no-wishyougrowth@gmail.com>',
      },
      template: {
        dir: join(process.cwd(), 'src/templates'), // ✅ absolute path
        adapter: new PugAdapter(),
        options: {
          strict: true,
        },
      }
    }),],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }



