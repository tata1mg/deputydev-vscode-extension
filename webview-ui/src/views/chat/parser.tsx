import React from 'react';
import { CircleUserRound } from 'lucide-react';
import { CodeBlock } from './codeBlock';

interface ChatContent {
    type: string;
    content: {
        user?: string;
        text?: string;
        language?: string;
        code?: string;
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
                    case 'USER':
                        return (
                            <div key={index} className='flex items-center gap-2 mb-4 p-2'>
                                <CircleUserRound className="text-neutral-400" size={18} />
                                <span className='text-white'>{chat.content.user}</span>
                            </div>
                        )
                    case 'TEXT':
                        return <span key={index} className='text-white mb-2 p-2'>{chat.content.text}</span>;
                    case "TEXT_DELTA":
                        return <span key={index} className='text-white mb-2 p-2'>{chat.content.text}</span>;
                    case 'CODE_BLOCK':
                        return (
                            <div className='mb-2'>
                                <CodeBlock language={chat.content.language || ""} code={chat.content.code || ""} />
                            </div>
                        );
                    default:
                        return null;
                }
            })}
        </div>
    );
}