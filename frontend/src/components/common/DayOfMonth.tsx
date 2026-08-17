import React from "react";

function getOrdinalSuffix(day: number): string {
  if (day >= 11 && day <= 13) return "th";
  switch (day % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
}

interface DayOfMonthProps {
  day: number;
}

export default function DayOfMonth({ day }: DayOfMonthProps) {
  return (
    <span>
      {day}
      <sup>{getOrdinalSuffix(day)}</sup> of every month
    </span>
  );
}
