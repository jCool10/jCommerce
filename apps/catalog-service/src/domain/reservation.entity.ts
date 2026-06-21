export interface ReservationProps {
  id: string;
  orderId: string;
  skuId: string;
  quantity: number;
  createdAt: Date;
}

export class Reservation {
  private constructor(private readonly props: ReservationProps) {}

  get id(): string {
    return this.props.id;
  }
  get orderId(): string {
    return this.props.orderId;
  }
  get skuId(): string {
    return this.props.skuId;
  }
  get quantity(): number {
    return this.props.quantity;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }

  static rehydrate(props: ReservationProps): Reservation {
    return new Reservation({ ...props });
  }

  static create(props: Omit<ReservationProps, 'createdAt'> & { createdAt?: Date }): Reservation {
    return new Reservation({ ...props, createdAt: props.createdAt ?? new Date() });
  }
}
