export interface CategoryProps {
  id: string;
  slug: string;
  name: string;
}

export class Category {
  private constructor(private readonly props: CategoryProps) {}

  get id(): string {
    return this.props.id;
  }
  get slug(): string {
    return this.props.slug;
  }
  get name(): string {
    return this.props.name;
  }

  static rehydrate(props: CategoryProps): Category {
    return new Category({ ...props });
  }
}
