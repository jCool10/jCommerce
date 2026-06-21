// Plain shipping-address record. No invariants beyond what the contract
// schema already enforces at the HTTP boundary — kept here as a typed
// shape so the domain doesn't import zod.

export interface ShippingAddress {
  line1: string;
  line2?: string;
  city: string;
  region?: string;
  postalCode: string;
  country: string;
}
