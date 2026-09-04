import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { VersioningType } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as bodyParser from 'body-parser';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  app.use(helmet());
  // Capture raw request body for webhook signature verification
  app.use(bodyParser.json({
    verify: (req: any, _res, buf: Buffer) => {
      req.rawBody = buf;
    },
  }));
  app.use(bodyParser.urlencoded({ extended: true, verify: (req: any, _res, buf: Buffer) => { req.rawBody = buf; } }));
  app.enableVersioning({
    type: VersioningType.URI
  })
  // ✅ Enable CORS before listen()
  app.enableCors({
    origin: '*',  // or your frontend origin like 'http://localhost:4200'
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  const config = new DocumentBuilder()
    .setTitle('Supermeals Backend Admin API')
    .setDescription('Swagger documentation for the Supermeals backend admin APIs')
    .setVersion('1.0')
    .addBearerAuth() // optional: enables Authorization header
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document);

  app.useGlobalPipes(new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
    transformOptions: {
      enableImplicitConversion: true,
    },
  }));

  // Global error logger — logs every uncaught exception (console + logs/error.log)
  // and returns a consistent JSON error response. See src/common/filters/http-exception.filter.ts
  app.useGlobalFilters(new HttpExceptionFilter());

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  const appUrl = await app.getUrl();
  const swaggerUrl = `${appUrl}/api-docs`;
  console.log(`Application URL: ${appUrl}`);
  console.log(`Swagger URL: ${swaggerUrl}`);
}
bootstrap();
