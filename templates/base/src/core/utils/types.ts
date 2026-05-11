// Empty type registry — apps add domain types as features grow.
// `InsetsProps` is consumed by `ui/appComponents/appButton` and a few other
// shipped primitives, so it stays.
export interface InsetsProps {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
}
