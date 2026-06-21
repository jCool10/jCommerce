import type { Currency } from '@jcool/contracts';

export interface OrderItemProps {
  id: string;
  orderId: string;
  skuId: string;
  quantity: number;
  unitAmount: number;
  currency: Currency;
}

// Snapshot of a SKU at order time. Catalog price drift after this point
// must NOT retro-mutate confirmed orders.
export class OrderItem {
  private constructor(private readonly props: OrderItemProps) {}

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
  get unitAmount(): number {
    return this.props.unitAmount;
  }
  get currency(): Currency {
    return this.props.currency;
  }

  get lineTotal(): number {
    return this.unitAmount * this.quantity;
  }

  static rehydrate(props: OrderItemProps): OrderItem {
    return new OrderItem({ ...props });
  }

  toJSON(): OrderItemProps {
    return { ...this.props };
  }
}
