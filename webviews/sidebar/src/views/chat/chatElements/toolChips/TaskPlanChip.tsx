import React, { useState } from 'react';
import { useThemeStore } from '@/stores/useThemeStore';
import { ChevronDown, ChevronUp, CheckCircle, Circle, ListTodo } from 'lucide-react';
import { ChatTaskPlanMessage } from '@/types';

type TaskPlanChipProps = {
  index: number;
  msg: ChatTaskPlanMessage;
};

export const TaskPlanChip: React.FC<TaskPlanChipProps> = ({ msg }) => {
  const { themeKind } = useThemeStore();
  const [isExpanded, setIsExpanded] = useState(true);

  const isLight = ['light', 'high-contrast-light'].includes(themeKind);
  const planSteps = msg.content.latest_plan_steps || [];

  const completedCount = planSteps.filter(step => step.is_completed).length;
  const totalCount = planSteps.length;

  return (
    <div
      className={`mt-2 flex flex-col rounded-md border px-3 py-2 ${
        isLight
          ? 'border-blue-300 bg-blue-50/60'
          : 'border-blue-500/40 bg-blue-900/20'
      }`}
    >
      {/* Header */}
      <div
        className={`flex cursor-pointer items-center justify-between gap-2 ${
          isLight ? 'text-gray-900' : 'text-blue-300'
        }`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <ListTodo className="h-4 w-4 flex-shrink-0" />
          <p className="text-sm font-semibold">Task Plan</p>
          <span className="text-xs font-normal opacity-70">
            ({completedCount}/{totalCount} completed)
          </span>
        </div>
        <div className="flex items-center">
          {isExpanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </div>
      </div>

      {/* Plan Steps */}
      {isExpanded && (
        <div className="mt-3 space-y-2">
          {planSteps.map((step, index) => (
            <div
              key={index}
              className={`flex items-start gap-2 rounded px-2 py-1.5 text-xs ${
                isLight
                  ? step.is_completed
                    ? 'bg-green-100/50'
                    : 'bg-gray-100/50'
                  : step.is_completed
                  ? 'bg-green-900/20'
                  : 'bg-gray-800/20'
              }`}
            >
              <div className="mt-0.5 flex-shrink-0">
                {step.is_completed ? (
                  <CheckCircle
                    className={`h-4 w-4 ${
                      isLight ? 'text-green-600' : 'text-green-400'
                    }`}
                  />
                ) : (
                  <Circle
                    className={`h-4 w-4 ${
                      isLight ? 'text-gray-400' : 'text-gray-500'
                    }`}
                  />
                )}
              </div>
              <div
                className={`flex-1 ${
                  step.is_completed
                    ? isLight
                      ? 'text-gray-700 line-through opacity-70'
                      : 'text-gray-400 line-through opacity-70'
                    : isLight
                    ? 'text-gray-800'
                    : 'text-gray-200'
                }`}
              >
                {step.step_description}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};