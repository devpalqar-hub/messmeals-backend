import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
    handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
        // If there's no token, just return `undefined` instead of throwing
        if (err || info || !user) {
            return undefined;
        }
        return user;
    }
}
