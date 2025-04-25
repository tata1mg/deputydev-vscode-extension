// import delay from "delay"
// import * as fs from "fs/promises"
// import * as path from "path"

// import { TerminalRegistry } from "./TerminalRegistry"
// import { Terminal } from "./TerminalManager"
// import { unescapeHtmlEntities } from "./utils/text-normalization"
// import { ExitCodeDetails, TerminalProcess } from "./TerminalProcess"


// export async function autoExecutePingCommand() {
//   const command = unescapeHtmlEntities("ping google.com")
//   const workingDir = "/Users/vaibhavmeena/Desktop/1mg/deputydev-vscode-extension"
//   const terminalOutputLineLimit = 500

//   try {
//     await fs.access(workingDir)
//   } catch (error) {
//     console.error(`Working directory '${workingDir}' does not exist.`)
//     return
//   }

//   const terminalInfo = await TerminalRegistry.getOrCreateTerminal(workingDir, true, "auto-task")
//   terminalInfo.terminal.show()

//   let result = ""
//   let completed = false
//   let exitDetails: ExitCodeDetails | undefined

//   const process = terminalInfo.runCommand(command, {
//     onLine: (line) => {
//       console.log(`[TERMINAL OUTPUT]: ${Terminal.compressTerminalOutput(line, terminalOutputLineLimit)}`)
//     },
//     onCompleted: (output) => {
//       result = output ?? ""
//       completed = true
//     },
//     onShellExecutionComplete: (details) => {
//       exitDetails = details
//     },
//     onNoShellIntegration: async (message) => {
//       console.warn(`[Shell Integration Warning]: ${message}`)
//     },
//   })

//   await process
//   await delay(50)

//   console.log("========= FINAL RESULT =========")
//   console.log(Terminal.compressTerminalOutput(result, terminalOutputLineLimit))

//   if (exitDetails) {
//     if (exitDetails.signal) {
//       console.log(`Terminated by signal ${exitDetails.signal} (${exitDetails.signalName})`)
//     } else {
//       console.log(`Exit Code: ${exitDetails.exitCode}`)
//     }
//   } else {
//     console.warn("Exit details were not captured.")
//   }

//   console.log("================================")
// }
