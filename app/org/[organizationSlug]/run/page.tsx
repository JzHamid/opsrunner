import { TaskRunner } from "@/components/task-runner";

type RunPageProps = {
  params: Promise<{ organizationSlug: string }>;
};

export default async function RunPage({ params }: RunPageProps) {
  const { organizationSlug } = await params;

  return <TaskRunner organizationSlug={organizationSlug} />;
}
