import { ValidationPipe } from '@nestjs/common';
import { BulkUploadQueryDto } from './bulk-upload-query.dto';

// Same options as main.ts — enableImplicitConversion is what makes "false" a trap.
const pipe = new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
    transformOptions: { enableImplicitConversion: true },
});
const run = (query: any) => pipe.transform(query, { type: 'query', metatype: BulkUploadQueryDto });

describe('BulkUploadQueryDto', () => {
    it('parses "true"/"false" strings correctly', async () => {
        expect(await run({ dryRun: 'true', isListed: 'false', isVerified: 'true' })).toMatchObject({
            dryRun: true, isListed: false, isVerified: true,
        });
    });

    it('leaves absent flags undefined', async () => {
        const dto = await run({});
        expect(dto.dryRun).toBeUndefined();
        expect(dto.isListed).toBeUndefined();
    });

    it('rejects unknown query params', async () => {
        await expect(run({ foo: 'bar' })).rejects.toThrow();
    });
});
