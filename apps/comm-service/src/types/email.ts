import { ProhibitReason } from "@prisma/client";

export type EmailMessage = {
    title: string;
    description: string;
    action: string;
};