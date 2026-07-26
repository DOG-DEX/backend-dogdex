import { Controller, Get, Post, Put, Delete, Param, Body, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PetService } from '../services/pet.service';
import { Public } from '../../../common/decorators/public.decorator';

@ApiTags('Pets')
@ApiBearerAuth()
@Controller('pets')
export class PetController {
  constructor(private readonly petService: PetService) {}

  @Get()
  findMine(@Request() req: any) {
    return this.petService.findByOwner(req.user._id);
  }

  @Public()
  @Get('qr/:qrCode')
  findByQr(@Param('qrCode') qrCode: string) {
    return this.petService.findByQrCode(qrCode);
  }

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.petService.findById(id);
  }

  @Post()
  create(@Body() body: any, @Request() req: any) {
    return this.petService.create({ ...body, owner: req.user._id });
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    return this.petService.update(id, req.user._id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req: any) {
    return this.petService.remove(id, req.user._id);
  }
}
