import { createReadStream } from 'node:fs';
import * as path from 'node:path';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { InvoicesService } from './invoices.service';
import { invoiceMulterOptions, UPLOADS_DIR } from './invoices.multer-options';

@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file', invoiceMulterOptions))
  create(@CurrentUser() user: { id: string }, @UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Keine Datei hochgeladen');
    }
    return this.invoicesService.create(user.id, file);
  }

  @Get()
  findAll(@CurrentUser() user: { id: string }) {
    return this.invoicesService.findAll(user.id);
  }

  @Get(':id/file')
  async getFile(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const invoice = await this.invoicesService.findOne(user.id, id);
    res.set({
      'Content-Type': invoice.mimeType,
      'Content-Disposition': `inline; filename="${encodeURIComponent(invoice.filename)}"`,
    });
    return new StreamableFile(createReadStream(path.join(UPLOADS_DIR, invoice.storagePath)));
  }

  @Patch(':id')
  update(@CurrentUser() user: { id: string }, @Param('id') id: string, @Body() dto: UpdateInvoiceDto) {
    return this.invoicesService.update(user.id, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.invoicesService.remove(user.id, id);
  }
}
