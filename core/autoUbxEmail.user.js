// ==UserScript==
// @name         [Experimental] autoUbxEmail
// @namespace    http://tampermonkey.net/
// @description  Custom template for message templates
// @author       You
// @match        https://ubox.uhaul.net/*/*/*/calendar?*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=uhaul.net
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    function addEmailButtons() {
        function standardizeAddress(address) {
            let standardized = address.toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
            standardized = standardized.replace(/\bPort Saint Lucie\b/g, "Port St Lucie");
            standardized = standardized.replace(/ Fl /g, " FL ");
            return standardized;
        }

        function generateEmail(dayEntry) {
            let emailText = "";

            function colorText_i(text, color = "rgb(200, 38, 19)") {
                return `<i style='color: ${color}'; font-family: Arial, sans-serif'; font-size: 12pt;'>${text}</i>`
    }

            function colorText(text, color = "black") {
                return `<span style='color: ${color}'; font-family: Arial, sans-serif'; font-size: 12pt;'>${text}</span>`
    }

    function getRouteName(routeName) {
        if (routeName.startsWith("UB") || routeName.startsWith("DB")) {
            return routeName + " w/"
        } else {
            return "* Box w/" + routeName.split(" ")[0]
        }
    }

    for (let route of dayEntry.routes) {
        if (route.routeStart !== "(Unassigned)") {
            emailText += "<b style='color: black; font-size: 14pt;'>" + getRouteName(route.routeStart) + "</b><br>";

            for (let movement of route.groupMovements) {
                if (movement.deliveryType.toLowerCase() === "transfer") {
                    emailText += "<b><i style='color: rgb(200, 38, 19); font-size: 12pt;'>TRANSFER</i> " + movement.transfer_Amount + " from " + `<i style='color: rgb(200, 38, 19); font-size: 12pt;'>${movement.transfer_From}</i>` + " to " + `<i style='color: rgb(200, 38, 19); font-size: 12pt;'>${movement.transfer_To}</i></b>` + "<br>";
                } else {
                    const actionWord = movement.deliveryType === "Deliver" ? "to" : "from";
                    emailText += "<b>" + colorText_i(movement.deliveryType.toUpperCase()) + " " + colorText(movement.boxNumbers.length) + " " + colorText(movement.delivery_Box) + " " + colorText(actionWord) + " " + colorText_i(movement.delivery_LastName) + colorText(" in ") + colorText_i(standardizeAddress(movement.delivery_City).toUpperCase()) + colorText(" between ") + colorText_i(movement.delivery_Window) + "</b><br>"

                    emailText += colorText(movement.delivery_PhoneNumber + "&nbsp;&nbsp;&nbsp;&nbsp;" + standardizeAddress(movement.delivery_Address)) + "<br>"
                }

                //emailText += colorText("notes: ", "light gray") + "<br>"

                if (movement.boxNumbers && movement.boxNumbers.length) {
                    emailText += "<ul style='font-size: 12pt;'>";
                    for (let box of movement.boxNumbers) {
                        emailText += "<li>" + colorText(box) + "</li>";
                    }
                    emailText += "</ul>";
                }

                emailText += "<br>";
            }

            emailText += "<br><br>";
        }
    }

    emailText += "";

    return emailText;
}

        const CalenderList = $(".calendar-days");
        let All = { days: [] };

        CalenderList.find("> .calendar-day").each(function(index) {
            const Day = $(this).find(".stop_row");
            const date = Day.data('date');
            const RouteDivs = $(this).find(".dynamic-routes > div");

            let dayEntry = { date: date, routes: [] };
            let currentRoute = null;

            RouteDivs.each(function() {
                if ($(this).hasClass('route-start')) {
                    if (currentRoute) {
                        dayEntry.routes.push(currentRoute);
                    }
                    currentRoute = {
                        routeStart: $(this).find(".route-name").text(),
                        groupMovements: []
                    };
                } else if ($(this).hasClass('group-movements') && currentRoute) {
                    $(this).find(".calendar-ubox").each(function() {
                        const DeliveryID = $(this).find("> .ubox").data("module");
                        const DeliveryToolTip = $(DeliveryID);

                        if (DeliveryToolTip.length) {
                            const DelTypeH1 = DeliveryToolTip.find("> h1").text().trim();
                            let inf_DelType;
                            let boxNumStorage = [];

                            // transfer segment
                            let transfer_Amount
                            let transfer_From
                            let transfer_To

                            // delivery/pickup segment
                            let delivery_LastName
                            let delivery_PhoneNumber
                            let delivery_Address
                            let delivery_City
                            let delivery_Window
                            let delivery_CoveringEntity
                            let delivery_Box

                            if (DelTypeH1.toLowerCase() === "scheduled transfer") {
                                inf_DelType = "Transfer";

                                const TransferString = DeliveryToolTip.find("p").text().trim().split(" ")
                                transfer_Amount = TransferString[2]
                                transfer_From = TransferString[4]
                                transfer_To = TransferString[6]

                                const BoxNumbers = DeliveryToolTip.find(".no-styles li");
                                BoxNumbers.each(function() {
                                    boxNumStorage.push($(this).text());
                                });
                            } else {
                                inf_DelType = DeliveryToolTip.find("> p > span").text().trim().split(" ")[0];
                                delivery_Box = DeliveryToolTip.find("> p > span").text().trim().split(" ")[3].toUpperCase();

                                const CustomerName = DeliveryToolTip.find(".no-styles > span:first").text().trim().split(" ");
                                delivery_LastName = CustomerName.slice(1).join(" ").toUpperCase();

                                const CustomerAddress = DeliveryToolTip.find(".no-styles > span:eq(1)").text().trim();
                                const CustomerAddressCityState = DeliveryToolTip.find(".no-styles > span:eq(2)").text().trim();
                                delivery_Address = CustomerAddress + ", " + CustomerAddressCityState
                                delivery_City = CustomerAddressCityState.split(",")[0].toUpperCase()

                                const CustomerPhoneNumber = DeliveryToolTip.find("a > span:first").text().trim()
                                delivery_PhoneNumber = CustomerPhoneNumber

                                if (DeliveryToolTip.find(".no-styles > span:eq(3)")) {
                                    if (DeliveryToolTip.find(".no-styles > text:eq(1) > span:eq(1)").text().trim().length > 0) {
                                        const timeWindow = DeliveryToolTip.find(".no-styles > text:eq(1) > span:eq(1)").text().trim()
                                        delivery_Window = timeWindow

                                        const coveringEntity = DeliveryToolTip.find(".no-styles > text:eq(2)").text().trim().split(":")[1].trim()
                                        delivery_CoveringEntity = coveringEntity
                                    } else {
                                        const timeWindow = DeliveryToolTip.find(".no-styles > text:eq(2) > span:eq(1)").text().trim()
                                        delivery_Window = timeWindow

                                        if (DeliveryToolTip.find(".no-styles > text:eq(3)").text()) {
                                            const coveringEntity = DeliveryToolTip.find(".no-styles > text:eq(3)").text().trim().split(":")[1].trim()
                                            delivery_CoveringEntity = coveringEntity
                                        }
                                    }
                                }

                                const BoxNumbers = DeliveryToolTip.find(".no-styles li");
                                BoxNumbers.each(function() {
                                    boxNumStorage.push($(this).text());
                                });
                            }

                            currentRoute.groupMovements.push({
                                deliveryType: inf_DelType,
                                deliveryID: DeliveryID,
                                tooltip: DeliveryToolTip,
                                boxNumbers: boxNumStorage,
                                transfer_Amount: transfer_Amount,
                                transfer_From: transfer_From,
                                transfer_To: transfer_To,
                                delivery_LastName: delivery_LastName,
                                delivery_PhoneNumber: delivery_PhoneNumber,
                                delivery_Address: delivery_Address,
                                delivery_City: delivery_City,
                                delivery_Window: delivery_Window,
                                delivery_CoveringEntity: delivery_CoveringEntity,
                                delivery_Box: delivery_Box
                            });
                        }
                    });
                }
            });

            if (currentRoute) {
                dayEntry.routes.push(currentRoute);
            }

            All.days.push(dayEntry);
        });

        CalenderList.find("> .calendar-day").each(function(index) {
            const NotesTab = $(this).find(".notes");
            let emailButton = $(this).find("#email");

            if(emailButton.length === 0) {
                emailButton = NotesTab.clone().attr('id', 'email');
                NotesTab.after(emailButton);
            }

            emailButton.find('.fa-file-text-o').remove();
            emailButton.find('span').text("Email").off('click').click(function(event) {
                event.preventDefault();

                const dayEntry = All.days[index];
                const emailText = generateEmail(dayEntry);

                navigator.clipboard.write([
                    new ClipboardItem({
                        'text/html': new Blob([emailText], { type: 'text/html' })
                    })
                ]);

                $(this).text("Copied!");
                setTimeout(() => {
                    $(this).text("Email");
                }, 700);

            });
        });
    }

    function runEmailButtons() {
        setInterval(() => {
            addEmailButtons()
        }, 2000);
    }

    runEmailButtons();
})();
