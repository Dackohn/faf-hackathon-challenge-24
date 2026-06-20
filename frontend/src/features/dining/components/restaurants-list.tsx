import { useState } from "react";

import { Spinner } from "@/components/ui/spinner";
import { RestaurantCard } from "@/features/dining/components/restaurant-card";
import { TableRow } from "@/features/dining/components/table-row";
import { useAvailability } from "@/features/dining/hooks/use-availability";
import { useRestaurants } from "@/features/dining/hooks/use-restaurants";
import { useReservation } from "@/features/dining/hooks/use-reservation";

const PARTY_SIZE = 1;

export function RestaurantsList() {
  const { restaurants, isLoading } = useRestaurants();
  const { reservation, book, isBooking } = useReservation();
  const [openRestaurantId, setOpenRestaurantId] = useState<string | null>(null);
  const { tables, isLoading: isLoadingTables } = useAvailability(
    openRestaurantId
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner className="size-6" />
      </div>
    );
  }

  if (restaurants.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-muted-foreground">
        No restaurants available.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {restaurants.map((restaurant) => {
        const isOpen = openRestaurantId === restaurant.id;
        return (
          <div key={restaurant.id} className="flex flex-col gap-2">
            <RestaurantCard
              restaurant={restaurant}
              isOpen={isOpen}
              onToggle={() =>
                setOpenRestaurantId(isOpen ? null : restaurant.id)
              }
            />
            {isOpen && (
              <div className="flex flex-col gap-1.5 pl-2">
                {isLoadingTables ? (
                  <div className="flex items-center justify-center py-4">
                    <Spinner className="size-5" />
                  </div>
                ) : (
                  tables.map((table) => (
                    <TableRow
                      key={table.id}
                      table={table}
                      isBooked={
                        reservation !== null &&
                        reservation.table_id === table.id
                      }
                      isBooking={isBooking}
                      onBook={() =>
                        book(restaurant.id, table.id, PARTY_SIZE)
                      }
                    />
                  ))
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
