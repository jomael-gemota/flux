import { Schema, model, Document } from 'mongoose';

export interface ProjectDocument extends Document {
    projectId:   string;
    name:        string;
    workflowIds: string[];
    /** MongoDB User ObjectId string — projects are always user-scoped */
    userId:      string;
    createdAt:   Date;
    updatedAt:   Date;
}

const ProjectSchema = new Schema<ProjectDocument>(
    {
        projectId:   { type: String, required: true, unique: true, index: true },
        name:        { type: String, required: true },
        workflowIds: [{ type: String }],
        userId:      { type: String, required: true, index: true },
    },
    { timestamps: true }
);

export const ProjectModel = model<ProjectDocument>('Project', ProjectSchema);
