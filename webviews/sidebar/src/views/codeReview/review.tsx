import { motion, AnimatePresence, AnimatePresenceProps } from 'framer-motion';
import { Check, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

interface Step {
  id: string;
  label: string;
  completed: boolean;
  inProgress: boolean;
  agents?: string[];
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

const AgentStatus = ({
  agent,
  completed,
  isActive,
}: {
  agent: string;
  completed: boolean;
  isActive: boolean;
}) => (
  <motion.div
    initial={{ opacity: 0, x: -10 }}
    animate={{ opacity: 1, x: 0 }}
    className="flex items-center gap-2"
  >
    {completed ? (
      <AnimatedCheck />
    ) : isActive ? (
      <LoadingSpinner />
    ) : (
      <div className="h-2 w-2 rounded-full bg-gray-400" />
    )}
    <span
      className={`text-xs ${completed ? 'text-green-500' : isActive ? 'text-yellow-500' : 'text-gray-500'}`}
    >
      {agent} agent {completed ? 'completed' : isActive ? 'in progress...' : 'pending...'}
    </span>
  </motion.div>
);

export const Review = ({ isRunning = false }: { isRunning: boolean }) => {
  const [steps, setSteps] = useState<Step[]>([
    {
      id: 'setup',
      label: 'Setting up review',
      completed: false,
      inProgress: true,
    },
    {
      id: 'reviewing',
      label: 'Reviewing files',
      completed: false,
      inProgress: false,
      agents: ['Security', 'Performance'],
    },
    {
      id: 'finalyzing',
      label: 'Finalyzing Review',
      completed: false,
      inProgress: false,
    },
  ]);

  const [completedAgents, setCompletedAgents] = useState<string[]>([]);

  useEffect(() => {
    if (!isRunning) return;

    const timers = [
      setTimeout(() => completeStep(0), 1500),
      setTimeout(() => completeStep(1), 3000),
      setTimeout(() => {
        completeAgent('Security');
      }, 3500),
      setTimeout(() => {
        completeAgent('Performance');
        completeStep(2);
      }, 4000),
    ];

    return () => timers.forEach((timer) => clearTimeout(timer));
  }, [isRunning]);

  const completeStep = (stepIndex: number) => {
    setSteps((prevSteps) =>
      prevSteps.map((step, i) => {
        if (i === stepIndex) {
          return { ...step, completed: true, inProgress: false };
        }
        if (i === stepIndex + 1) {
          return { ...step, inProgress: true };
        }
        return step;
      })
    );
  };

  const completeAgent = (agent: string) => {
    setCompletedAgents((prev) => [...prev, agent]);
  };

  useEffect(() => {
    if (!isRunning) {
      setSteps((prevSteps) =>
        prevSteps.map((step, i) => ({
          ...step,
          completed: false,
          inProgress: i === 0,
        }))
      );
      setCompletedAgents([]);
    }
  }, [isRunning]);

  const isAgentCompleted = (agent: string) => completedAgents.includes(agent);

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
                    {step.completed ? (
                      <AnimatedCheck />
                    ) : step.inProgress ? (
                      <LoadingSpinner />
                    ) : (
                      <div className="h-2 w-2 rounded-full bg-gray-400" />
                    )}
                  </motion.div>
                  <motion.span
                    className={`text-sm ${step.completed
                        ? 'text-green-600 dark:text-green-400'
                        : step.inProgress
                          ? 'font-medium'
                          : 'text-gray-500 dark:text-gray-400'
                      }`}
                    layout="position"
                  >
                    {step.label}
                  </motion.span>
                </div>

                <AnimatePresence>
                  {step.agents && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      className="ml-9 space-y-2 overflow-hidden border-l-2 border-gray-200 pl-4 dark:border-gray-700"
                    >
                      {step.agents.map((agent) => (
                        <AgentStatus
                          key={agent}
                          agent={agent}
                          completed={isAgentCompleted(agent)}
                          isActive={step.inProgress || completedAgents.includes(agent)}
                        />
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
