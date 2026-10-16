import { createFileRoute } from "@tanstack/react-router";
import { BallArenaPage } from "@/components/BallArenaPage";

export const Route = createFileRoute("/")({ component: BallArenaPage });
