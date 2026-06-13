import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { RolesGuard } from '../../common/auth/roles.guard';
import { UserRole } from '../../common/roles';
import { SettingsService } from '../settings/application/settings.service';
import { OrdersService } from './application/orders.service';
import { CreateOrderDto, ReactivateOrderDto } from './dto/order.dto';

@Controller('api/orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly settingsService: SettingsService,
  ) {}

  @Post()
  create(@CurrentUser() user: any, @Body() dto: CreateOrderDto) {
    return this.ordersService.create(user.id, dto);
  }

  @Get('my-history')
  myHistory(@CurrentUser() user: any) {
    return this.ordersService.listByBuyer(user.id);
  }

  @Get('my-cashback')
  myCashback(@CurrentUser() user: any) {
    return this.ordersService.cashbackAvailableForBuyer(user.id);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.SuperUser)
  @Get('active')
  active() {
    return this.ordersService.list(true);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.SuperUser)
  @Get('attended')
  attended() {
    return this.ordersService.list(false);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.SuperUser)
  @Get('buyers-summary')
  async buyersSummary() {
    const { pesosPerPoint, cashbackPesos } = await this.settingsService.getPointsRate();
    return {
      pesosPerPoint,
      cashbackPesos,
      buyers: await this.ordersService.buyerSummary(pesosPerPoint, cashbackPesos),
    };
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.SuperUser)
  @Patch(':id/attend')
  attend(@Param('id') id: string) {
    return this.ordersService.attend(Number(id));
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.SuperUser)
  @Patch(':id/reactivate')
  reactivate(@Param('id') id: string, @Body() dto: ReactivateOrderDto) {
    return this.ordersService.reactivate(Number(id), dto.restoreStock === true);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.SuperUser)
  @Delete(':id')
  close(@Param('id') id: string) {
    return this.ordersService.closeAttended(Number(id));
  }
}
