import { Controller, Get, Put, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UserService } from '../services/user.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/user')
export class BffUserController {
  constructor(private readonly userService: UserService) {}

  @Get('profile')
  @ApiOperation({ summary: 'Get current user profile' })
  async getProfile(@Req() req: any) {
    return this.userService.getById(req.user.userId);
  }

  @Put('profile')
  @ApiOperation({ summary: 'Update user profile' })
  async updateProfile(@Req() req: any, @Body() updateData: any) {
    return this.userService.updateUserById(req.user.userId, updateData);
  }

  @Delete('profile')
  @ApiOperation({ summary: 'Delete current user account' })
  async deleteProfile(@Req() req: any) {
    await this.userService.deleteUser(req.user.userId);
    return { message: 'Tài khoản của bạn đã được xóa thành công.' };
  }

  @Roles('admin', 'de')
  @Get('all')
  @ApiOperation({ summary: 'Get all users (Admin/DE)' })
  async getAllUsers(@Query('page') page: string, @Query('limit') limit: string, @Query('search') search: string) {
    return this.userService.getAll({
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 10,
      search,
    });
  }

  @Roles('admin')
  @Delete(':id')
  @ApiOperation({ summary: 'Delete user by ID (Admin)' })
  async deleteUser(@Param('id') id: string) {
    await this.userService.deleteUser(id);
    return { message: 'Người dùng đã được xóa thành công.' };
  }
}
