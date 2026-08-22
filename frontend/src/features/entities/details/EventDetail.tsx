import { ExternalLink } from "lucide-react";
import type { CalendarEvent } from "@/mocks/entities.types";
import { formatDateTime } from "./format";
import { DetailField, DetailGrid, PersonLine, SectionHeading } from "./shared";

export function EventDetail({ event }: { event: CalendarEvent }) {
  return (
    <div className="space-y-6">
      {event.description && <p className="text-sm text-muted-foreground">{event.description}</p>}

      <DetailGrid>
        <DetailField label="Starts">
          {formatDateTime(event.startTime)}
          {event.timezone && <span className="text-muted-foreground"> ({event.timezone})</span>}
        </DetailField>
        <DetailField label="Ends">{event.endTime ? formatDateTime(event.endTime) : "—"}</DetailField>
        <DetailField label="Location">{event.location ?? "—"}</DetailField>
        <DetailField label="Organizer"><PersonLine person={event.organizer} /></DetailField>
      </DetailGrid>

      {event.url && (
        <a
          href={event.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex w-fit items-center gap-1 text-sm text-primary hover:underline"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Join / view event
        </a>
      )}

      <div className="space-y-3">
        <SectionHeading>Attendees</SectionHeading>
        {event.attendees.length === 0 ? (
          <p className="text-sm text-muted-foreground">No attendees listed.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {event.attendees.map((attendee, index) => (
              <li key={attendee.email ?? index}>
                <PersonLine person={attendee} />
              </li>
            ))}
          </ul>
        )}
      </div>

      {event.attachments.length > 0 && (
        <div className="space-y-3">
          <SectionHeading>Attachments</SectionHeading>
          <div className="space-y-2">
            {event.attachments.map((attachment) => (
              <div key={attachment.documentId} className="rounded-lg border p-3 text-sm">
                <div className="font-medium">{attachment.document?.title ?? attachment.filename}</div>
                <div className="text-xs text-muted-foreground">{attachment.filename}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
