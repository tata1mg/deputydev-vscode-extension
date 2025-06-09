import { ChevronDown, ChevronUp, CircleX, CircleCheckBig } from 'lucide-react';
import { useState } from 'react';

export default function FilesEdited() {
    const [showAllChangedFiles, setShowAllChangedFiles] = useState(false);
    return (
        <div className="flex justify-center pl-3 pr-3">
            <div
                className="flex w-full flex-col rounded-t-md border-l-2 border-r-2 border-t-2 border-gray-700"
                style={{
                    backgroundColor: 'var(--vscode-editor-background)',
                }}
            >
                {showAllChangedFiles &&
                    <div
                        className="flex max-h-[150px] overflow-y-auto p-2"
                        style={{
                            backgroundColor: 'var(--vscode-editor-background)',
                        }}
                    >
                        <div className='flex justify-between items-center w-full'>
                            <button
                                className="flex items-center min-w-0 flex-1"
                            >
                                <div className="flex flex-col gap-1 min-w-0 w-full">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm text-ellipsis whitespace-nowrap overflow-hidden text-left">
                                            codeActionPanelFileEdit.tsx
                                        </span>
                                        <div className="flex items-center gap-1 text-xs">
                                            <span className="text-green-500">+12</span>
                                            <span className="text-red-500">-20</span>
                                        </div>
                                    </div>
                                    <span className="text-gray-500 text-xs text-ellipsis whitespace-nowrap overflow-hidden w-full text-left">
                                        chat/chatElements/codeActionPanelFileEdit.tsx
                                    </span>
                                </div>
                            </button>
                            <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                                <CircleCheckBig className='h-5 w-5 text-green-500' />
                                <CircleX className='h-5 w-5 text-red-600' />
                            </div>
                        </div>
                    </div>
                }
                <div className="m-1.5 flex items-center justify-between gap-2">
                    <button className='flex items-center gap-2 min-w-0 flex-1 cursor-pointer' onClick={() => setShowAllChangedFiles(!showAllChangedFiles)}>
                        {showAllChangedFiles ?
                            <ChevronDown className="flex-shrink-0" />
                            :
                            <ChevronUp className="flex-shrink-0" />
                        }
                        <div className="text-sm text-ellipsis whitespace-nowrap overflow-hidden">
                            23 files changed
                        </div>
                    </button>
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                            className="text-green-500 border border-green-500 p-[2px] whitespace-nowrap text-xs"
                            onClick={() => { }}
                        >
                            Accept All
                        </button>
                        <button
                            className='text-red-600 border border-red-600 p-[2px] whitespace-nowrap text-xs'
                            onClick={() => { }}
                        >
                            Reject All
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}