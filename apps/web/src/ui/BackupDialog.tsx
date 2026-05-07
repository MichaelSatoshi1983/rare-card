import { Dialog } from "@base-ui/react/dialog";
import { Import, Save, X } from "lucide-react";
import type { ChangeEvent, RefObject } from "react";
import { AppButton } from "./AppButton";
import { ActionToolbar } from "./ActionToolbar";

function BackupDialog({
  fileInputRef,
  importError,
  onExport,
  onImport
}: {
  fileInputRef: RefObject<HTMLInputElement | null>;
  importError: string;
  onExport: () => void;
  onImport: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <Dialog.Root>
      <Dialog.Trigger render={<AppButton variant="secondary"><Save size={17} />备份与导入</AppButton>} />
      <Dialog.Portal>
        <Dialog.Backdrop className="DialogBackdrop" />
        <Dialog.Popup className="DialogPopup">
          <div className="DialogHeader">
            <div>
              <Dialog.Title className="DialogTitle">备份与导入</Dialog.Title>
              <Dialog.Description className="DialogDescription">导出当前资料，或从本工具生成的 JSON 备份恢复。</Dialog.Description>
            </div>
            <Dialog.Close render={<AppButton variant="icon" aria-label="关闭"><X size={18} /></AppButton>} />
          </div>
          {importError ? <div className="InlineAlert" role="alert">{importError}</div> : null}
          <input ref={fileInputRef} type="file" accept="application/json" onChange={onImport} hidden />
          <ActionToolbar label="备份操作" className="DialogActions">
            <AppButton variant="primary" onClick={onExport}>
              <Save size={18} />
              导出备份
            </AppButton>
            <AppButton variant="secondary" onClick={() => fileInputRef.current?.click()}>
              <Import size={18} />
              导入备份
            </AppButton>
          </ActionToolbar>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export { BackupDialog };
