import { ApiProperty } from '@nestjs/swagger';
import {IsIn, IsNotEmpty, IsOptional, IsString} from "class-validator";

export class JoinRequestAnswerDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    requestId: string;

    @IsIn(['accept', 'reject'])
    decision: 'accept' | 'reject';

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    reason?: string;
}
