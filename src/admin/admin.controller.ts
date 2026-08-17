import { Controller, Get, Param, Delete, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminGuard } from 'src/guards/admin.guard';

@UseGuards(AdminGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('all-users')
  findAllUsers() {
    return this.adminService.findAllUsers();
  }

  @Get('plan-details/:planId')
  findPlanDetails(@Param('planId') planId: string) {
    return this.adminService.findPlanDetails(planId);
  }

  @Delete('delete-user/:id')
  deleteUser(@Param('id') id: string) {
    return this.adminService.deleteUser(id);
  }

  @Delete('delete-plan/:id')
  deletePlan(@Param('id') id: string) {
    return this.adminService.deletePlan(id);
  }
}
