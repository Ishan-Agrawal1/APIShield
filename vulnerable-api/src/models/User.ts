import mongoose, { type InferSchemaType } from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    _id: { type: Number, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['user', 'admin'], required: true },
  },
  { versionKey: false },
);

export type UserDocument = InferSchemaType<typeof userSchema> & {
  _id: number;
};

export const User = mongoose.model('User', userSchema);

export function toPublicUser(user: UserDocument) {
  return {
    id: user._id,
    email: user.email,
    role: user.role,
  };
}
