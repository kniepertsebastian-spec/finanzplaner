import { PartialType } from '@nestjs/mapped-types';
import { CreateSavingsPotDto } from './create-savings-pot.dto';

export class UpdateSavingsPotDto extends PartialType(CreateSavingsPotDto) {}
