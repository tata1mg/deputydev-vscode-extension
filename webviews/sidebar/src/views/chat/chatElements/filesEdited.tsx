export default function FilesEdited() {
    return (
        <div className="flex justify-center pl-3 pr-3">
            <div
                className="flex w-full flex-col rounded-t-md border-l-2 border-r-2 border-t-2 border-gray-700"
                style={{
                    backgroundColor: 'var(--vscode-editor-background)',
                }}
            >
                <div
                    className="flex max-h-[150px] cursor-pointer flex-col justify-between overflow-y-auto"
                    style={{
                        backgroundColor: 'var(--vscode-editor-background)',
                    }}
                >

                </div>
                <div className="m-1.5 flex items-center justify-between">
                    <div className="mr-2 flex items-center gap-2">
                        23 files changed
                    </div>
                    <div className="flex items-center gap-2">
                        <button className="text-green-500">Accept All</button>
                        <button>Reject All</button>
                    </div>
                </div>
            </div>
        </div>
    )
}