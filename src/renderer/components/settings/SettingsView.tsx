/**
 * SettingsView - Project-level settings with tabbed navigation.
 *
 * Provides a unified settings panel for project configuration including:
 * - Communication (SMS/Email via Twilio/SMTP)
 * - Voice (ElevenLabs AI screening)
 *
 * Used in OutreachSection Sheet for project-specific settings.
 */

import { useState } from "react";
import { useParams } from "react-router-dom";
import {
  MessageSquare,
  Phone,
  Mail,
  Settings as SettingsIcon,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { CommunicationSettings } from "./CommunicationSettings";
import { VoiceSettings } from "./VoiceSettings";

/**
 * Project settings view with Communication and Voice tabs.
 * Provides a consistent interface for all project-level provider settings.
 */
export function SettingsView() {
  const { id: projectId } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState("communication");

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 pb-2 border-b border-border">
        <SettingsIcon className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Project Settings</h2>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger
            value="communication"
            className="flex items-center gap-2"
          >
            <MessageSquare className="h-4 w-4" />
            Communication
          </TabsTrigger>
          <TabsTrigger value="voice" className="flex items-center gap-2">
            <Phone className="h-4 w-4" />
            Voice
          </TabsTrigger>
        </TabsList>

        <TabsContent value="communication" className="mt-4 space-y-0">
          <CommunicationSettings />
        </TabsContent>

        <TabsContent value="voice" className="mt-4 space-y-0">
          <VoiceSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default SettingsView;
