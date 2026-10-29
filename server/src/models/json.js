// Shared JSON shape: expose `id`, hide `_id` and password hashes
export const toJSON = {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => { delete ret._id; delete ret.password; delete ret.passwordChangedAt },
}
