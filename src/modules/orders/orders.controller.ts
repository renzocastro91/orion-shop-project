import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { RolesGuard } from '../../common/auth/roles.guard';
import { UserRole } from '../../common/roles';
import { OrdersService } from './application/orders.service';
import { CreateOrderDto } from './dto/order.dto';

@Controller('api/orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  create(@CurrentUser() user: any, @Body() dto: CreateOrderDto) {
    return this.ordersService.create(user.id, dto);
  }

  @Get('my-history')
  myHistory(@CurrentUser() user: any) {
    return this.ordersService.listByBuyer(user.id);
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
  @Patch(':id/attend')
  attend(@Param('id') id: string) {
    return this.ordersService.setActive(Number(id), false);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.SuperUser)
  @Patch(':id/reactivate')
  reactivate(@Param('id') id: string) {
    return this.ordersService.setActive(Number(id), true);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.SuperUser)
  @Delete(':id')
  close(@Param('id') id: string) {
    return this.ordersService.closeAttended(Number(id));
  }
}
