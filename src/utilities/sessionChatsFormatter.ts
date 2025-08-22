export function formatSessionChats(rawSessionChats: any[]) {
  const formattedChats: any[] = [];
  for (const chat of rawSessionChats) {
    switch (chat.actor) {
      case 'USER':
        if (chat.message_data?.message_type === 'TEXT') {
          formattedChats.push({
            type: 'TEXT_BLOCK',
            content: {
              text: chat.message_data?.text,
            },
            focusItems: chat.message_data?.focus_items,
            attachments: chat.message_data?.attachments,
            actor: 'USER',
          });
        }
        break;
      case 'ASSISTANT':
        if (chat.message_data?.message_type === 'TEXT') {
          formattedChats.push({
            type: 'TEXT_BLOCK',
            content: {
              text: chat.message_data?.text,
            },
            actor: 'ASSISTANT',
          });
        } else if (chat.message_data?.message_type === 'THINKING') {
          formattedChats.push({
            type: 'THINKING',
            text: chat.message_data?.thinking_summary,
            status: (chat.message_data?.thinking_status || '').toLowerCase() || 'completed',
            actor: 'ASSISTANT',
          });
        } else if (chat.message_data?.message_type === 'TOOL_USE') {
          formattedChats.push({
            type: 'TOOL_CHIP_UPSERT',
            content: {
              tool_name: chat.message_data?.tool_name,
              tool_use_id: chat.message_data?.tool_use_id,
              status: (chat.message_data?.tool_status || '').toLowerCase(),
              toolRequest: {
                toolName: chat.message_data?.tool_name,
                requestData: chat.message_data?.tool_input,
              },
              toolResponse: chat.message_data?.tool_response,
              isHistory: true,
            },
          });
        } else if (chat.message_data?.message_type === 'CODE_BLOCK') {
          formattedChats.push({
            type: 'CODE_BLOCK',
            content: {
              language: chat.message_data?.language,
              file_path: chat.message_data?.file_path,
              code: chat.message_data?.code,
              is_diff: chat.message_data?.diff !== undefined && chat.message_data?.diff !== '',
              diff: chat.message_data?.diff,
              added_lines: chat.message_data?.added_lines,
              removed_lines: chat.message_data?.removed_lines,
            },
          });
        }
        break;
      case 'SYSTEM':
        formattedChats.push({
          type: 'INFO',
          actor: 'SYSTEM',
          content: {
            info: chat.message_data?.info,
          },
        });
        break;
      default:
        break;
    }
  }
  return formattedChats;
}
