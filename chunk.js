      if (data._action === "save_memories" || data._action === "override_memories") {
        var scriptProperties = PropertiesService.getScriptProperties();
        var str = JSON.stringify(data.data || {});
        
        // 刪除舊的
        var keys = scriptProperties.getKeys();
        for (var i = 0; i < keys.length; i++) {
            if (keys[i].indexOf("YOUQUAN_MEMORIES_") === 0 || keys[i] === "YOUQUAN_MEMORIES") {
                scriptProperties.deleteProperty(keys[i]);
            }
        }
        
        // 切割存儲
        var chunkSize = 8000;
        var chunks = Math.ceil(str.length / chunkSize);
        scriptProperties.setProperty("YOUQUAN_MEMORIES_CHUNKS", chunks.toString());
        
        for (var j = 0; j < chunks; j++) {
            scriptProperties.setProperty("YOUQUAN_MEMORIES_" + j, str.substring(j * chunkSize, (j + 1) * chunkSize));
        }
        return ContentService.createTextOutput(JSON.stringify({ status: "success", chunks: chunks }))
          .setMimeType(ContentService.MimeType.JSON);
      }
