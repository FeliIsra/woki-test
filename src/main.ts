import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import pino from "pino";
import pinoHttp from "pino-http";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { addAlias } from "module-alias";

addAlias("@", __dirname);

import { AppModule } from "./app.module";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";
import { LoggingInterceptor } from "./common/interceptors/logging.interceptor";

async function bootstrap(): Promise<void> {
    const app = await NestFactory.create(AppModule, {
        bufferLogs: true,
    });

    const configService = app.get(ConfigService);
    const logLevel = configService.get<string>("app.log.level") ?? "info";
    const logger = pino({
        level: logLevel,
        base: undefined,
    });

    const corsConfig = configService.get<{
        enabled: boolean;
        origins: string[];
        methods: string;
        allowCredentials: boolean;
    }>("app.cors");

    if (corsConfig?.enabled) {
        app.enableCors({
            origin: corsConfig.origins.length ? corsConfig.origins : true,
            methods: corsConfig.methods,
            credentials: corsConfig.allowCredentials,
            allowedHeaders: ["Content-Type", "Authorization", "Idempotency-Key"],
            exposedHeaders: ["Retry-After"],
        });
    }

    app.use(
        pinoHttp({
            logger,
            customLogLevel: (_req, res, err) => {
                if (res.statusCode >= 500 || err) {
                    return "error";
                }
                if (res.statusCode >= 400) {
                    return "warn";
                }
                return "info";
            },
        })
    );

    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            transform: true,
            forbidUnknownValues: true,
            transformOptions: { enableImplicitConversion: true },
        })
    );
    app.useGlobalFilters(new HttpExceptionFilter(logger));
    app.useGlobalInterceptors(new LoggingInterceptor(logger));

    const swaggerConfig = new DocumentBuilder()
        .setTitle("WokiBrain Booking API")
        .setDescription(
            "REST interface for the WokiBrain booking engine covering discovery, bookings, waitlist, and metrics."
        )
        .setVersion("1.0.0")
        .addTag("Bookings", "Booking discovery and lifecycle operations")
        .addTag("Waitlist", "Waitlist intake and management")
        .addTag("Metrics", "Operational metrics exposure")
        .build();
    const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup("docs", app, swaggerDocument, {
        swaggerOptions: {
            persistAuthorization: true,
            displayRequestDuration: true,
        },
    });

    const port = configService.get<number>("app.port") ?? 4000;
    await app.listen(port);
    logger.info({ port }, "WokiBrain booking engine listening");
}

void bootstrap();
