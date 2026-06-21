import type { Reservation } from '../reservation.entity.js';

export interface ReservationRepository {
  findByOrderId(orderId: string): Promise<Reservation[]>;
}

export const RESERVATION_REPOSITORY = Symbol('RESERVATION_REPOSITORY');
