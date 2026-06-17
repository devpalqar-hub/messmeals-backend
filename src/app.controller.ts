import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('App')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) { }

  @Get()
  @ApiOperation({ summary: 'Health check', description: 'Returns a simple hello response for the API root.' })
  @ApiResponse({ status: 200, description: 'API root is reachable.' })
  getHello(): string {
    return this.appService.getHello();
  }
}
