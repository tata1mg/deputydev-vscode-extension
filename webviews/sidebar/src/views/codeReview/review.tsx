import { motion, AnimatePresence } from 'framer-motion';
import { Check, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

type Status = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'ERROR';

interface Agent {
  name: string;
  status: Status;
}

interface Step {
  id: string;
  label: string;
  status: Status;
  agents?: Agent[];
}

const AnimatedCheck = () => (
  <motion.div
    initial={{ scale: 0, rotate: -180 }}
    animate={{ scale: 1, rotate: 0 }}
    transition={{ type: 'spring', stiffness: 200, damping: 15 }}
  >
    <Check className="h-4 w-4 text-white" />
  </motion.div>
);

const LoadingSpinner = () => (
  <motion.div
    animate={{ rotate: 360 }}
    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
  >
    <Loader2 className="h-4 w-4 text-yellow-500" />
  </motion.div>
);

const AgentStatus = ({ agent, status }: { agent: Agent; status: Status }) => {
  const isCompleted = status === 'COMPLETED';
  const isActive = status === 'IN_PROGRESS';

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center gap-2"
    >
      {isCompleted ? (
        <AnimatedCheck />
      ) : isActive ? (
        <LoadingSpinner />
      ) : (
        <div className="h-2 w-2 rounded-full bg-gray-400" />
      )}
      <span
        className={`text-xs ${
          isCompleted ? 'text-green-500' : isActive ? 'text-yellow-500' : 'text-gray-500'
        }`}
      >
        {agent.name} agent {isCompleted ? 'completed' : isActive ? 'in progress...' : 'pending...'}
      </span>
    </motion.div>
  );
};

export const Review = ({ isRunning = false }: { isRunning: boolean }) => {
  const [steps, setSteps] = useState<Step[]>([
    {
      id: 'setup',
      label: 'Setting up review',
      status: 'PENDING',
    },
    {
      id: 'reviewing',
      label: 'Reviewing files',
      status: 'PENDING',
      agents: [
        { name: 'Security', status: 'PENDING' },
        { name: 'Performance', status: 'PENDING' },
      ],
    },
    {
      id: 'finalyzing',
      label: 'Finalizing Review',
      status: 'PENDING',
    },
  ]);

  useEffect(() => {
    if (!isRunning) return;

    const timers = [
      setTimeout(() => updateStepStatus(0, 'IN_PROGRESS'), 500),
      setTimeout(() => updateStepStatus(0, 'COMPLETED'), 1500),
      setTimeout(() => {
        updateStepStatus(1, 'IN_PROGRESS');
        updateAgentStatus(1, 'Security', 'IN_PROGRESS');
      }, 1600),
      setTimeout(() => updateAgentStatus(1, 'Security', 'COMPLETED'), 2500),
      setTimeout(() => {
        updateAgentStatus(1, 'Performance', 'IN_PROGRESS');
      }, 2600),
      setTimeout(() => {
        updateAgentStatus(1, 'Performance', 'COMPLETED');
        updateStepStatus(1, 'COMPLETED');
        updateStepStatus(2, 'IN_PROGRESS');
      }, 3500),
      setTimeout(() => updateStepStatus(2, 'COMPLETED'), 4500),
    ];

    return () => timers.forEach((timer) => clearTimeout(timer));
  }, [isRunning]);

  const updateStepStatus = (stepIndex: number, status: Status) => {
    setSteps((prevSteps) =>
      prevSteps.map((step, i) => (i === stepIndex ? { ...step, status } : step))
    );
  };

  const updateAgentStatus = (stepIndex: number, agentName: string, status: Status) => {
    setSteps((prevSteps) =>
      prevSteps.map((step, i) => {
        if (i !== stepIndex || !step.agents) return step;

        return {
          ...step,
          agents: step.agents.map((agent) =>
            agent.name === agentName ? { ...agent, status } : agent
          ),
        };
      })
    );
  };

  useEffect(() => {
    if (!isRunning) {
      setSteps((prevSteps) =>
        prevSteps.map((step) => ({
          ...step,
          status: 'PENDING',
          agents: step.agents?.map((agent) => ({ ...agent, status: 'PENDING' })),
        }))
      );
    }
  }, [isRunning]);

  const getStatusIcon = (status: Status) => {
    switch (status) {
      case 'COMPLETED':
        return <AnimatedCheck />;
      case 'IN_PROGRESS':
        return <LoadingSpinner />;
      case 'ERROR':
        return <div className="h-2 w-2 rounded-full bg-red-500" />;
      default:
        return <div className="h-2 w-2 rounded-full bg-gray-400" />;
    }
  };

  const getStatusTextColor = (status: Status) => {
    switch (status) {
      case 'COMPLETED':
        return 'text-green-600 dark:text-green-400';
      case 'IN_PROGRESS':
        return 'text-yellow-500 dark:text-yellow-400';
      case 'ERROR':
        return 'text-red-500 dark:text-red-400';
      default:
        return 'text-gray-500 dark:text-gray-400';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col gap-2 px-4 py-2"
    >
      <div className="overflow-hidden rounded-lg border border-[var(--vscode-editorWidget-border)] bg-[var(--vscode-editor-background)] shadow-sm">
        <motion.div className="flex flex-col p-4" layout>
          <motion.h2
            className="mb-4 text-lg font-medium"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            Review Progress
          </motion.h2>

          <motion.div className="space-y-4" layout>
            {steps.map((step, index) => (
              <motion.div
                key={step.id}
                className="space-y-2"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <div className="flex items-center gap-3">
                  <motion.div className="flex h-6 w-6 items-center justify-center" layout>
                    {getStatusIcon(step.status)}
                  </motion.div>
                  <motion.span
                    className={`text-sm font-medium ${getStatusTextColor(step.status)}`}
                    layout="position"
                  >
                    {step.label}
                  </motion.span>
                </div>

                <AnimatePresence>
                  {step.agents && step.agents.length > 0 && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="ml-9 space-y-2 overflow-hidden border-l-2 border-gray-200 pl-4 dark:border-gray-700"
                    >
                      {step.agents.map((agent) => (
                        <AgentStatus key={agent.name} agent={agent} status={agent.status} />
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      </div>
    </motion.div>
  );
};
