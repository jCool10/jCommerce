import { Injectable } from '@nestjs/common';
import { Reservation } from '../../domain/reservation.entity.js';
import type { ReservationRepository } from '../../domain/ports/reservation.repository.js';
import { PrismaService } from './prisma.service.js';

@Injectable()
export class PrismaReservationRepository implements ReservationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByOrderId(orderId: string): Promise<Reservation[]> {
    const rows = await this.prisma.reservation.findMany({ where: { orderId } });
    return rows.map((r) =>
      Reservation.rehydrate({
        id: r.id,
        orderId: r.orderId,
        skuId: r.skuId,
        quantity: r.quantity,
        createdAt: r.createdAt,
      }),
    );
  }
}
