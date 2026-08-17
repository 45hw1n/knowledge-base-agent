import { Settings2 } from "lucide-react";
import { PrivacyToggle } from "@/components/PrivacyToggle";
import { AppSignOut } from "@/components/AppSignOut";
import { Button } from "@/lib/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/lib/ui/popover";

export function AppSettings() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" aria-label="App settings">
          <Settings2 className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-3">
        <div className="space-y-4">
          <PrivacyToggle variant="popover" persistOnChange />

          <AppSignOut />
        </div>
      </PopoverContent>
    </Popover>
  );
}
