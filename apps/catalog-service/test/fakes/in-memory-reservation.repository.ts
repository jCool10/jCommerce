import type { Reservation } from '../../src/domain/reservation.entity.js';
import type { ReservationRepository } from '../../src/domain/ports/reservation.repository.js';

export class InMemoryReservationRepository implements ReservationRepository {
  private readonly byOrderId = new Map<string, Reservation[]>();

  seed(orderId: string, reservations: Reservation[]): void {
    this.byOrderId.set(orderId, reservations);
  }

  async findByOrderId(orderId: string): Promise<Reservation[]> {
    return this.byOrderId.get(orderId) ?? [];
  }
}
