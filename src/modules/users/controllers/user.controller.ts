import {
  Controller,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UserService } from '../services/user.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { UpdateProfileDto } from '../dto/update-profile.dto';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('profile')
  @ApiOperation({ summary: 'Get current user profile' })
  async getProfile(@Req() req: any) {
    return this.userService.getById(req.user.userId);
  }

  @Put('profile')
  @ApiOperation({ summary: 'Update user profile' })
  async updateProfile(@Req() req: any, @Body() updateData: UpdateProfileDto) {
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
  async getAllUsers(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('search') search?: string,
  ) {
    return this.userService.getAll({
      page,
      limit,
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
