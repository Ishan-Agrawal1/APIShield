import mongoose, { type InferSchemaType } from 'mongoose';

const noteSchema = new mongoose.Schema(
  {
    _id: { type: Number, required: true },
    userId: { type: Number, required: true, index: true },
    title: { type: String, required: true },
    content: { type: String, required: true, default: '' },
    visibility: { type: String, enum: ['private', 'public'], required: true, default: 'private' },
  },
  {
    versionKey: false,
    timestamps: true,
  },
);

export type NoteDocument = InferSchemaType<typeof noteSchema> & {
  _id: number;
  createdAt: Date;
  updatedAt: Date;
};

export const Note = mongoose.model('Note', noteSchema);

export function toPublicNote(note: NoteDocument) {
  return {
    id: note._id,
    userId: note.userId,
    title: note.title,
    content: note.content,
    visibility: note.visibility ?? 'private',
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
  };
}
