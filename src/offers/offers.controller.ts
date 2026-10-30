import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { OffersService } from './offers.service';
import { ClaimOfferDto } from './dto/offer.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/decorators/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';

@ApiTags('Website Offers (v1)')
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('MESSADMIN', 'SUPERADMIN')
@ApiBearerAuth()
export class OffersController {
  constructor(private readonly svc: OffersService) {}

  @Get(['api/v1/offers/website/eligibility', 'v1/offers/website/eligibility'])
  @ApiOperation({
    summary: 'Check website offer eligibility',
    description: 'Checks if business is eligible for the promotional free website (first 200 businesses).',
  })
  @ApiQuery({ name: 'messId', required: false, description: 'Optional business UUID' })
  getEligibility(@Req() req: any, @Query('messId') messId?: string) {
    return this.svc.getEligibility(req.user, messId);
  }

  @Post(['api/v1/offers/website/claim', 'v1/offers/website/claim'])
  @ApiOperation({
    summary: 'Claim free website offer',
    description: 'Claims the free website promotion for the business, locking in promotional pricing.',
  })
  claimOffer(@Req() req: any, @Body() dto: ClaimOfferDto) {
    return this.svc.claimOffer(req.user, dto);
  }

  @Post(['api/v1/offers/website/dismiss', 'v1/offers/website/dismiss'])
  @ApiOperation({
    summary: 'Dismiss website offer',
    description: 'Declines/dismisses the promotional website offer and advances onboarding.',
  })
  dismissOffer(@Req() req: any, @Body() dto: ClaimOfferDto) {
    return this.svc.dismissOffer(req.user, dto);
  }

  @Get(['api/v1/offers/website/status', 'v1/offers/website/status'])
  @ApiOperation({
    summary: 'Get website offer claim status',
    description: 'Returns CLAIMED, DISMISSED, or NOT_CLAIMED status.',
  })
  @ApiQuery({ name: 'messId', required: false, description: 'Optional business UUID' })
  getStatus(@Req() req: any, @Query('messId') messId?: string) {
    return this.svc.getStatus(req.user, messId);
  }
}
