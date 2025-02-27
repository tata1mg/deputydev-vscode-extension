import React from 'react';
import { CircleUserRound } from 'lucide-react';
import { CodeBlock } from './codeBlock';

interface ChatContent {
    type: string;
    actor: string;
    content: {
        user?: string;
        text?: string;
        language?: string;
        code?: string;
        file_path?: string;
    };
}

interface ParserUIProps {
    sessionChats: ChatContent[];
}


export function ParserUI({ sessionChats }: ParserUIProps) {
    return (
        <div>
            {sessionChats.map((chat, index) => {
                switch (chat.type) {
                    case 'TEXT_BLOCK':
                        if (chat.actor === "USER") {
                            return (
                                <div key={index} className='flex items-center gap-2 mb-4 p-2'>
                                    <CircleUserRound className="text-neutral-400" size={18} />
                                    <span className='text-white'>{chat.content.text}</span>
                                </div>
                            )
                        } else {
                            return <p key={index} className='text-white mb-2 p-2'>{chat.content.text}</p>;
                        }
                    case 'CODE_BLOCK':
                        return (
                            <div className='mb-2'>
                                <CodeBlock language={chat.content.language || ""} code={chat.content.code || ""} file_path={chat.content.file_path || ""} />
                            </div>
                        );
                    case "THINKING_BLOCK":
                        return <p key={index} className='text-white mb-2 p-2'>{chat.content.text}</p>;
                    default:
                        return null;
                }
            })}
        </div>
    );
}