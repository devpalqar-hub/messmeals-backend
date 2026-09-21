import { CanActivate, ExecutionContext, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { RolesGuard } from 'src/common/decorators/roles.guard';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { MessBulkUploadController } from './mess-bulk-upload.controller';
import { MessBulkUploadService } from './mess-bulk-upload.service';
import { buildMessTemplate } from './mess-excel.template';

/// Stands in for the JWT guard: role comes from the `x-role` header (absent => unauthenticated).
class HeaderAuthGuard implements CanActivate {
    canActivate(ctx: ExecutionContext) {
        const req = ctx.switchToHttp().getRequest();
        if (!req.headers['x-role']) return false;
        req.user = { id: 'u1', role: req.headers['x-role'] };
        return true;
    }
}

describe('MessBulkUploadController (HTTP)', () => {
    let app: INestApplication;
    const service = { getTemplate: jest.fn(), upload: jest.fn() };

    beforeAll(async () => {
        const moduleRef = await Test.createTestingModule({
            controllers: [MessBulkUploadController],
            providers: [{ provide: MessBulkUploadService, useValue: service }],
        })
            .overrideGuard(JwtAuthGuard).useClass(HeaderAuthGuard)
            .compile();
        app = moduleRef.createNestApplication();
        app.useGlobalPipes(new ValidationPipe({
            transform: true, whitelist: true, forbidNonWhitelisted: true,
            transformOptions: { enableImplicitConversion: true },
        }));
        await app.init();
    });

    afterAll(() => app.close());
    beforeEach(() => jest.resetAllMocks());

    const asSuperadmin = { 'x-role': 'SUPERADMIN' };

    it('rejects unauthenticated callers and non-superadmins', async () => {
        await request(app.getHttpServer()).get('/admin/mess-bulk-upload/template').expect(403);
        await request(app.getHttpServer()).get('/admin/mess-bulk-upload/template').set('x-role', 'MESSADMIN').expect(403);
        await request(app.getHttpServer()).post('/admin/mess-bulk-upload').set('x-role', 'MESSADMIN')
            .attach('file', Buffer.from('x'), 'a.xlsx').expect(403);
        expect(service.upload).not.toHaveBeenCalled();
    });

    it('serves the template as an .xlsx download', async () => {
        service.getTemplate.mockResolvedValue(await buildMessTemplate(false));
        const res = await request(app.getHttpServer())
            .get('/admin/mess-bulk-upload/template?withSamples=false').set(asSuperadmin).expect(200)
            .buffer().parse((r, cb) => { const chunks: Buffer[] = []; r.on('data', (c) => chunks.push(c)); r.on('end', () => cb(null, Buffer.concat(chunks))); });
        expect(res.headers['content-type']).toContain('spreadsheetml.sheet');
        expect(res.headers['content-disposition']).toContain('mess-bulk-upload-template.xlsx');
        expect((res.body as Buffer).subarray(0, 2).toString()).toBe('PK'); // xlsx = zip
        expect(service.getTemplate).toHaveBeenCalledWith(false);
    });

    it('passes the uploaded file and parsed flags to the service', async () => {
        service.upload.mockResolvedValue({ message: 'ok', summary: {}, results: [] });
        const file = await buildMessTemplate(true);
        await request(app.getHttpServer())
            .post('/admin/mess-bulk-upload?dryRun=true&isListed=false&isVerified=true')
            .set(asSuperadmin).attach('file', file, 'messes.xlsx').expect(201);
        expect(service.upload).toHaveBeenCalledTimes(1);
        const [buffer, opts] = service.upload.mock.calls[0];
        expect(Buffer.isBuffer(buffer) && buffer.length).toBe(file.length);
        expect(opts).toEqual({ dryRun: true, isListed: false, isVerified: true });
    });

    it('defaults to a real, unlisted, unverified import', async () => {
        service.upload.mockResolvedValue({});
        await request(app.getHttpServer()).post('/admin/mess-bulk-upload').set(asSuperadmin)
            .attach('file', Buffer.from('x'), 'messes.xlsx').expect(201);
        expect(service.upload.mock.calls[0][1]).toEqual({ dryRun: false, isListed: false, isVerified: false });
    });

    it('400s when no file is sent', async () => {
        const res = await request(app.getHttpServer()).post('/admin/mess-bulk-upload').set(asSuperadmin).expect(400);
        expect(res.body.message).toContain('Excel file is required');
    });

    it('400s for non-.xlsx files', async () => {
        const res = await request(app.getHttpServer()).post('/admin/mess-bulk-upload').set(asSuperadmin)
            .attach('file', Buffer.from('a,b'), 'messes.csv').expect(400);
        expect(res.body.message).toContain('.xlsx');
        expect(service.upload).not.toHaveBeenCalled();
    });

    it('413s for files over the size limit', async () => {
        await request(app.getHttpServer()).post('/admin/mess-bulk-upload').set(asSuperadmin)
            .attach('file', Buffer.alloc(5 * 1024 * 1024 + 1), 'big.xlsx').expect(413);
    });
});
