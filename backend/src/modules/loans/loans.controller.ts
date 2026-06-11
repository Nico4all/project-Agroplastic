import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateLoanDto } from './dto/create-loan.dto';
import { CreateLoanPaymentDto } from './dto/create-loan-payment.dto';
import { QueryLoansDto } from './dto/query-loans.dto';
import { UpdateLoanDto } from './dto/update-loan.dto';
import { LoansService } from './loans.service';

@UseGuards(JwtAuthGuard)
@Controller('loans')
export class LoansController {
  constructor(private readonly loans: LoansService) {}

  @Get()
  findAll(@CurrentUser() user: { userId: string }, @Query() query: QueryLoansDto) {
    return this.loans.findAll(user.userId, query);
  }

  @Post()
  create(@CurrentUser() user: { userId: string }, @Body() dto: CreateLoanDto) {
    return this.loans.create(user.userId, dto);
  }

  @Patch(':id')
  update(@CurrentUser() user: { userId: string }, @Param('id') id: string, @Body() dto: UpdateLoanDto) {
    return this.loans.update(user.userId, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: { userId: string }, @Param('id') id: string) {
    return this.loans.remove(user.userId, id);
  }

  @Post(':id/payments')
  createPayment(@CurrentUser() user: { userId: string }, @Param('id') id: string, @Body() dto: CreateLoanPaymentDto) {
    return this.loans.createPayment(user.userId, id, dto);
  }

  @Get(':id/payments')
  findPayments(@CurrentUser() user: { userId: string }, @Param('id') id: string) {
    return this.loans.findPayments(user.userId, id);
  }

  @Delete(':loanId/payments/:paymentId')
  removePayment(
    @CurrentUser() user: { userId: string },
    @Param('loanId') loanId: string,
    @Param('paymentId') paymentId: string,
  ) {
    return this.loans.removePayment(user.userId, loanId, paymentId);
  }
}
